'use client';

import { useState } from 'react';
import { Save, Loader2, User, Bell, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { getSupabase } from '@/lib/supabase/singleton';
import { ROLE_LABELS } from '@/lib/roles';

export default function SettingsPage() {
  const { profile, session } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState({
    expiryAlerts: true,
    lowStockAlerts: true,
    emailNotifications: false,
  });

  const handleSave = async () => {
    setSaving(true);
    const supabase = getSupabase();
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', profile?.id);
    if (error) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Đã lưu cài đặt' });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cài đặt</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quản lý tài khoản và tùy chọn hệ thống</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Thông tin tài khoản
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={session?.user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Họ và tên</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Label>Vai trò:</Label>
              <Badge variant="secondary">{profile ? ROLE_LABELS[profile.role] : '—'}</Badge>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Lưu thay đổi
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-primary" />
              Thông báo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Cảnh báo hạn sử dụng</p>
                <p className="text-xs text-muted-foreground">Thông báo khi hóa chất sắp hết hạn</p>
              </div>
              <Switch checked={notifications.expiryAlerts} onCheckedChange={(v) => setNotifications({ ...notifications, expiryAlerts: v })} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Cảnh báo tồn kho thấp</p>
                <p className="text-xs text-muted-foreground">Thông báo khi tồn kho dưới mức tối thiểu</p>
              </div>
              <Switch checked={notifications.lowStockAlerts} onCheckedChange={(v) => setNotifications({ ...notifications, lowStockAlerts: v })} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email thông báo</p>
                <p className="text-xs text-muted-foreground">Gửi thông báo qua email</p>
              </div>
              <Switch checked={notifications.emailNotifications} onCheckedChange={(v) => setNotifications({ ...notifications, emailNotifications: v })} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Thông tin hệ thống
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Phiên bản</p>
              <p className="font-semibold">1.0.0</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hệ quản trị CSDL</p>
              <p className="font-semibold">Supabase</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Framework</p>
              <p className="font-semibold">Next.js 13</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
