import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Building2, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/src/components/ui/button';
import { Input, Label } from '@/src/components/ui/input';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Enter a valid work or resident email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { availablePersonas, loginAsPersona } = useAuth();
  const navigate = useNavigate();
  const [selectedRoleHint, setSelectedRoleHint] = useState<string>('usr-admin-1');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'ananya.deshmukh@propaxis.in',
      password: '••••••••••',
    },
  });

  const handleSignIn = (values: LoginFormValues) => {
    const matched =
      availablePersonas.find((p) => p.email.toLowerCase() === values.email.toLowerCase()) ||
      availablePersonas.find((p) => p.id === selectedRoleHint) ||
      availablePersonas[0];

    loginAsPersona(matched.id);
    toast.success(`Signed in as ${matched.name}`);
    navigate(matched.role === 'tenant' ? '/tenant/home' : '/');
  };

  const quickSelectPersona = (id: string) => {
    const persona = availablePersonas.find((p) => p.id === id);
    if (!persona) return;
    setSelectedRoleHint(id);
    setValue('email', persona.email);
    setValue('password', 'propaxis-demo');
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-slate-50">
      {/* Left Architectural Context Panel */}
      <div className="relative hidden lg:flex flex-col justify-between bg-[#0B1324] p-10 text-white overflow-hidden">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 font-display font-bold text-sm">
            PA
          </div>
          <span className="font-display text-xl font-bold tracking-tight">PropAxis</span>
        </div>

        <div className="relative z-10 max-w-lg space-y-5">
          <p className="text-xs font-medium tracking-wide text-blue-300">
            Enterprise Property Operations & Leasing Automation
          </p>
          <h1 className="font-display text-3xl font-semibold leading-tight text-balance">
            Unified leasing, tenant operations, and AI communication across every building.
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Role-scoped workspaces for Company Administrators, Property Managers, and invited Residents—backed by
            multi-channel Voice, SMS, and Email orchestration and manager-approved execution controls.
          </p>
          <div className="grid grid-cols-3 gap-4 border-t border-slate-800 pt-6 text-xs">
            <div>
              <p className="font-mono text-lg font-semibold text-white tabular-nums">4</p>
              <p className="text-slate-400">Managed Towers</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-white tabular-nums">₹34.7 L</p>
              <p className="text-slate-400">Monthly Rent Book</p>
            </div>
            <div>
              <p className="font-mono text-lg font-semibold text-white tabular-nums">3</p>
              <p className="text-slate-400">Synced Channels</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-400">
          Tenants access the portal via administrator or manager invitation only.
        </p>
      </div>

      {/* Right Sign-in Form & Role Switcher */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-7">
          <div>
            <div className="mb-4 flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-display font-bold text-xs text-white">
                PA
              </div>
              <span className="font-display text-lg font-bold text-slate-900">PropAxis</span>
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
              Sign in to workspace
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Select an evaluation role below or sign in with invited credentials.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Evaluation Personas (Instant Role Context)</Label>
            <div className="grid gap-2">
              {availablePersonas.map((persona) => {
                const active = selectedRoleHint === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => quickSelectPersona(persona.id)}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-blue-600 bg-blue-50/70 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{persona.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {persona.role === 'admin'
                          ? 'Company Admin · Full Portfolio'
                          : persona.role === 'manager'
                            ? `Property Manager · ${persona.assignedPropertyIds.length} Assigned Properties`
                            : 'Tenant · Invited Resident Account'}
                      </p>
                    </div>
                    {active ? (
                      <UserCheck className="h-4 w-4 text-blue-700 shrink-0" />
                    ) : (
                      <Building2 className="h-4 w-4 text-slate-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit(handleSignIn)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email Address</Label>
              <Input id="login-email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input id="login-password" type="password" {...register('password')} />
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <Button type="submit" variant="primary" className="w-full">
              <span>Enter Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-700 shrink-0" />
            <p>
              Tenant self-registration is disabled by policy. Resident accounts are provisioned exclusively via
              Company Admin or Property Manager invitations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
