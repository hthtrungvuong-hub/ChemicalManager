'use client';

import { useEffect, useState } from 'react';
import { PackagePlus, Loader2, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { formatDateTime, formatNumber, formatDate } from '@/lib/expiry';
import type { Chemical, StorageLocation, StockMovement } from '@/lib/types';

export default function StockInPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    chemical_id: '',
    lot_number: '',
    quantity: '',
    unit: 'g',
    received_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    storage_location_id: '',
    supplier: '',
    notes: '',
  });

  useEffect(() => {
    async function loadData() {
      const supabase = getSupabase();
      const [{ data: chems }, { data: locs }, { data: moves }] = await Promise.all([
        supabase.from('chemicals').select('*').order('name'),
        supabase.from('storage_locations').select('*').order('name'),
        supabase.from('stock_movements').select('*').eq('movement_type', 'in').order('created_at', { ascending: false }).limit(20),
      ]);
      setChemicals((chems || []) as Chemical[]);
      setLocations((locs || []) as StorageLocation[]);
      setMovements((moves || []) as StockMovement[]);
      setLoading(false);
    }
    loadData();
  }, []);

  const selectedChem = chemicals.find((c) => c.id === form.chemical_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.chemical_id || !form.quantity) {
      toast({ title: 'Vui lòng chọn hóa chất và nhập số lượng', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const supabase = getSupabase();
    const qty = parseFloat(form.quantity) || 0;
    const unit = selectedChem?.unit || form.unit;

    try {
      const lotNumber = form.lot_number || `IN-${Date.now()}`;
      const { data: lot, error: lotError } = await supabase
        .from('lots')
        .insert({
          chemical_id: form.chemical_id,
          lot_number: lotNumber,
          quantity: qty,
          initial_quantity: qty,
          unit,
          received_date: form.received_date || null,
          expiry_date: form.expiry_date || null,
          storage_location_id: form.storage_location_id || null,
          supplier: form.supplier,
          status: 'active',
        })
        .select()
        .single();

      if (lotError) throw lotError;

      const { error: moveError } = await supabase.from('stock_movements').insert({
        movement_type: 'in',
        lot_id: lot.id,
        chemical_id: form.chemical_id,
        quantity: qty,
        unit,
        reference: lotNumber,
        user_id: profile?.id,
        user_name: profile?.full_name || '',
        notes: form.notes,
      });

      if (moveError) throw moveError;

      toast({ title: 'Nhập kho thành công', description: `${qty} ${unit} đã được thêm` });

      setForm({
        chemical_id: '',
        lot_number: '',
        quantity: '',
        unit: 'g',
        received_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        storage_location_id: '',
        supplier: '',
        notes: '',
      });

      const { data: newMoves } = await supabase
        .from('stock_movements').select('*').eq('movement_type', 'in').order('created_at', { ascending: false }).limit(20);
      setMovements((newMoves || []) as StockMovement[]);
    } catch (err) {
      toast({ title: 'Lỗi nhập kho', description: err instanceof Error ? err.message : 'Đã có lỗi', variant: 'destructive' });
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nhập kho</h1>
        <p className="mt-1 text-sm text-muted-foreground">Thêm lô hóa chất mới vào kho</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PackagePlus className="h-5 w-5 text-primary" />
              Phiếu nhập kho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Hóa chất *</Label>
                <Select value={form.chemical_id} onValueChange={(v) => setForm({ ...form, chemical_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Chọn hóa chất" /></SelectTrigger>
                  <SelectContent>
                    {chemicals.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số lô</Label>
                  <Input
                    value={form.lot_number}
                    onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
                    placeholder="Tự sinh nếu trống"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Số lượng *</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ngày nhập</Label>
                  <Input
                    type="date"
                    value={form.received_date}
                    onChange={(e) => setForm({ ...form, received_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hạn sử dụng</Label>
                  <Input
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vị trí lưu trữ</Label>
                <Select value={form.storage_location_id} onValueChange={(v) => setForm({ ...form, storage_location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Chọn vị trí" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} {l.room && `(${l.room})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nhà cung cấp</Label>
                <Input
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Nhập kho
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-muted-foreground" />
              Lịch sử nhập kho gần đây
            </CardTitle>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chưa có phiếu nhập nào</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hóa chất</TableHead>
                      <TableHead className="text-right">Số lượng</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Thực hiện</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">{m.reference}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-success">
                          +{formatNumber(m.quantity)} {m.unit}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</TableCell>
                        <TableCell className="text-sm">{m.user_name || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
