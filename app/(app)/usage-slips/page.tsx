'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Loader2, Check, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';
import { getSupabase } from '@/lib/supabase/singleton';
import { formatDateTime, formatNumber } from '@/lib/expiry';
import type { Chemical, Lot, UsageSlip, UsageSlipItem } from '@/lib/types';

interface SlipWithItems extends UsageSlip {
  usage_slip_items?: UsageSlipItem[];
}

interface FormItem {
  lot_id: string;
  chemical_name: string;
  quantity: string;
  unit: string;
}

export default function UsageSlipsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [slips, setSlips] = useState<SlipWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [lots, setLots] = useState<Lot[]>([]);
  const [chemicals, setChemicals] = useState<Record<string, Chemical>>({});

  const [purpose, setPurpose] = useState('');
  const [items, setItems] = useState<FormItem[]>([]);

  useEffect(() => {
    async function loadData() {
      const supabase = getSupabase();
      const [{ data: slipData }, { data: lotData }, { data: chemData }] = await Promise.all([
        supabase.from('usage_slips').select('*, usage_slip_items(*)').order('created_at', { ascending: false }),
        supabase.from('lots').select('*').gt('quantity', 0),
        supabase.from('chemicals').select('*'),
      ]);
      setSlips((slipData || []) as SlipWithItems[]);

      const activeLots = (lotData || []).filter((l: Lot) => l.quantity > 0) as Lot[];
      setLots(activeLots);

      const chemMap: Record<string, Chemical> = {};
      (chemData || []).forEach((c: Chemical) => { chemMap[c.id] = c; });
      setChemicals(chemMap);
      setLoading(false);
    }
    loadData();
  }, []);

  const openNewSlip = () => {
    setPurpose('');
    setItems([{ lot_id: '', chemical_name: '', quantity: '', unit: '' }]);
    setDialogOpen(true);
  };

  const addRow = () => {
    setItems([...items, { lot_id: '', chemical_name: '', quantity: '', unit: '' }]);
  };

  const removeRow = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof FormItem, value: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'lot_id') {
      const lot = lots.find((l) => l.id === value);
      const chem = lot ? chemicals[lot.chemical_id] : null;
      updated[idx].chemical_name = chem?.name || '';
      updated[idx].unit = lot?.unit || '';
    }
    setItems(updated);
  };

  const handleCreate = async () => {
    if (!purpose.trim()) {
      toast({ title: 'Vui lòng nhập mục đích sử dụng', variant: 'destructive' });
      return;
    }
    const validItems = items.filter((i) => i.lot_id && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) {
      toast({ title: 'Vui lòng thêm ít nhất một hóa chất', variant: 'destructive' });
      return;
    }

    for (const item of validItems) {
      const lot = lots.find((l) => l.id === item.lot_id);
      if (lot && parseFloat(item.quantity) > lot.quantity) {
        toast({ title: `Số lượng vượt tồn kho cho ${item.chemical_name}`, variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    const supabase = getSupabase();

    try {
      const slipCount = await supabase.from('usage_slips').select('id', { count: 'exact', head: true });
      const year = new Date().getFullYear();
      const slipNumber = `US-${year}-${String((slipCount.count || 0) + 1).padStart(3, '0')}`;

      const { data: slip, error: slipError } = await supabase
        .from('usage_slips')
        .insert({
          slip_number: slipNumber,
          user_id: profile?.id,
          user_name: profile?.full_name || '',
          purpose,
          status: 'confirmed',
        })
        .select()
        .single();

      if (slipError) throw slipError;

      for (const item of validItems) {
        const lot = lots.find((l) => l.id === item.lot_id)!;
        const qty = parseFloat(item.quantity);

        await supabase.from('usage_slip_items').insert({
          slip_id: slip.id,
          lot_id: item.lot_id,
          chemical_name: item.chemical_name,
          quantity_used: qty,
          unit: item.unit,
        });

        const newQty = lot.quantity - qty;
        const newStatus = newQty <= 0 ? 'depleted' : 'active';
        await supabase.from('lots').update({ quantity: newQty, status: newStatus, updated_at: new Date().toISOString() }).eq('id', lot.id);

        await supabase.from('stock_movements').insert({
          movement_type: 'out',
          lot_id: lot.id,
          chemical_id: lot.chemical_id,
          quantity: -qty,
          unit: lot.unit,
          reference: slipNumber,
          user_id: profile?.id,
          user_name: profile?.full_name || '',
          notes: `Phiếu sử dụng: ${purpose}`,
        });
      }

      toast({ title: 'Tạo phiếu thành công', description: slipNumber });
      setDialogOpen(false);

      const { data: newSlips } = await supabase
        .from('usage_slips').select('*, usage_slip_items(*)').order('created_at', { ascending: false });
      setSlips((newSlips || []) as SlipWithItems[]);

      const { data: newLots } = await supabase.from('lots').select('*').gt('quantity', 0);
      setLots((newLots || []) as Lot[]);
    } catch (err) {
      toast({ title: 'Lỗi tạo phiếu', description: err instanceof Error ? err.message : 'Đã có lỗi', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Phiếu sử dụng</h1>
          <p className="mt-1 text-sm text-muted-foreground">{slips.length} phiếu đã tạo</p>
        </div>
        <Button onClick={openNewSlip}>
          <Plus className="mr-2 h-4 w-4" />
          Tạo phiếu
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Số phiếu</TableHead>
                  <TableHead>Mục đích</TableHead>
                  <TableHead>Người tạo</TableHead>
                  <TableHead className="text-right">Số mặt hàng</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Chưa có phiếu nào
                    </TableCell>
                  </TableRow>
                ) : (
                  slips.map((slip) => (
                    <TableRow key={slip.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">{slip.slip_number}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-medium">{slip.purpose}</TableCell>
                      <TableCell className="text-sm">{slip.user_name || '—'}</TableCell>
                      <TableCell className="text-right">{slip.usage_slip_items?.length || 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(slip.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={slip.status === 'confirmed' ? 'default' : 'secondary'}>
                          {slip.status === 'confirmed' ? 'Đã xác nhận' : 'Nháp'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo phiếu sử dụng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mục đích sử dụng *</Label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="VD: Thí nghiệm hóa hữu cơ..."
              />
            </div>

            <div className="space-y-2">
              <Label>Danh sách hóa chất</Label>
              {items.map((item, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    {idx === 0 && <Label className="text-xs">Hóa chất / Lô</Label>}
                    <Select value={item.lot_id} onValueChange={(v) => updateRow(idx, 'lot_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Chọn lô" /></SelectTrigger>
                      <SelectContent>
                        {lots.map((l) => {
                          const chem = chemicals[l.chemical_id];
                          return (
                            <SelectItem key={l.id} value={l.id}>
                              {chem?.name} - Lô {l.lot_number} ({formatNumber(l.quantity)} {l.unit})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28 space-y-1">
                    {idx === 0 && <Label className="text-xs">Số lượng</Label>}
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => removeRow(idx)} disabled={items.length === 1}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="mr-2 h-4 w-4" />
                Thêm hóa chất
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Check className="mr-2 h-4 w-4" />
              Xác nhận phiếu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
