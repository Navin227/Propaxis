import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Edit3, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { authService } from '@/src/services/auth/authService';
import { propertyService } from '@/src/services/properties/propertyService';
import { UserAccount, UserRole } from '@/src/types';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Input, Label } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Switch } from '@/src/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { StatusTag } from '@/src/components/ui/status-indicator';
import { ErrorState, LoadingState } from '@/src/components/ui/state-views';
import { formatRelativeTime } from '@/src/utils/formatters';

const userSchema = z.object({
  name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(8),
  userRole: z.enum(['admin', 'manager']),
  designation: z.string().min(2),
});

type UserFormValues = z.infer<typeof userSchema>;

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => authService.listUsers(),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertyService.listProperties(),
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '+91 ',
      userRole: 'manager',
      designation: 'Property Manager',
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      authService.createUser({
        ...values,
        assignedPropertyIds: values.userRole === 'admin' ? properties.map((p) => p.id) : selectedPropertyIds,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Account created and invitation sent to ${created.email}`);
      setModalOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<UserAccount> }) =>
      authService.updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User permissions & property scope updated');
      setModalOpen(false);
      setEditingUser(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingUser(null);
    setSelectedPropertyIds([properties[0]?.id || 'prop-1']);
    form.reset({
      name: '',
      email: '',
      phone: '+91 ',
      userRole: 'manager',
      designation: 'Property Manager',
    });
    setModalOpen(true);
  };

  const openEdit = (u: UserAccount) => {
    setEditingUser(u);
    setSelectedPropertyIds(u.assignedPropertyIds);
    form.reset({
      name: u.name,
      email: u.email,
      phone: u.phone,
      userRole: u.role === 'admin' ? 'admin' : 'manager',
      designation: u.designation,
    });
    setModalOpen(true);
  };

  const togglePropertyAssignment = (propId: string) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(propId) ? prev.filter((id) => id !== propId) : [...prev, propId]
    );
  };

  if (isLoading) return <LoadingState rows={5} />;
  if (isError) return <ErrorState message="Failed to load team accounts." onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">User & Property Access Management</h2>
          <p className="text-sm text-slate-500">
            Company Admin workspace to provision Property Managers, assign buildings, and control account status.
          </p>
        </div>

        <Button variant="primary" onClick={openCreate}>
          <UserPlus className="h-4 w-4" />
          Create Property Manager
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Assigned Property Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-right">Controls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const assignedNames =
                u.role === 'admin'
                  ? 'All Company Properties'
                  : properties
                      .filter((p) => u.assignedPropertyIds.includes(p.id))
                      .map((p) => p.name)
                      .join(', ') || 'None assigned';

              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">
                      {u.email} · {u.designation}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs font-medium capitalize text-slate-700">
                      <ShieldCheck className="h-3.5 w-3.5 text-blue-700" />
                      {u.role === 'admin' ? 'Company Admin' : u.role === 'manager' ? 'Property Manager' : 'Tenant'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-slate-600">{assignedNames}</TableCell>
                  <TableCell>
                    <StatusTag label={u.status} showIcon />
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 tabular-nums">
                    {formatRelativeTime(u.lastActiveAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-3">
                      {u.role !== 'tenant' && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={u.status === 'Active'}
                              onCheckedChange={(checked) =>
                                updateMutation.mutate({
                                  id: u.id,
                                  payload: { status: checked ? 'Active' : 'Inactive' },
                                })
                              }
                              aria-label={`Toggle active state for ${u.name}`}
                            />
                          </div>
                          <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                            <Edit3 className="h-3.5 w-3.5" />
                            Assign
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? `Edit Access — ${editingUser.name}` : 'Create Property Manager Account'}
            </DialogTitle>
            <DialogDescription>
              Assign specific buildings to enforce strict Property Manager RBAC boundaries.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((values) => {
              if (editingUser) {
                updateMutation.mutate({
                  id: editingUser.id,
                  payload: {
                    name: values.name,
                    email: values.email,
                    phone: values.phone,
                    role: values.userRole as UserRole,
                    designation: values.designation,
                    assignedPropertyIds:
                      values.userRole === 'admin' ? properties.map((p) => p.id) : selectedPropertyIds,
                  },
                });
              } else {
                createMutation.mutate(values);
              }
            })}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="u-name">Full Name</Label>
                <Input id="u-name" {...form.register('name')} placeholder="e.g. Vikram Nair" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-email">Work Email</Label>
                <Input id="u-email" type="email" {...form.register('email')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-phone">Phone</Label>
                <Input id="u-phone" {...form.register('phone')} />
              </div>
              <div className="space-y-1.5">
                <Label>Account Role</Label>
                <Select
                  value={form.watch('userRole')}
                  onValueChange={(v) => form.setValue('userRole', v as 'admin' | 'manager')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Property Manager</SelectItem>
                    <SelectItem value="admin">Company Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-desig">Title / Cluster</Label>
                <Input id="u-desig" {...form.register('designation')} />
              </div>
            </div>

            {form.watch('userRole') === 'manager' && (
              <div className="space-y-2">
                <Label>Assigned Properties Scope</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-lg border border-slate-200 p-3">
                  {properties.map((p) => {
                    const checked = selectedPropertyIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePropertyAssignment(p.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-700"
                        />
                        <span>
                          {p.name} ({p.city})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingUser ? 'Save Permissions' : 'Create & Invite Manager'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
