'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, QrCode, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { QRDialog } from '@/components/chemicals/qr-dialog';
import { ExpiryBadge } from '@/components/chemicals/expiry-badge';
import { getSupabase } from '@/lib/supabase/singleton';
import { useAuth } from '@/lib/auth-context';
import { canManageStock } from '@/lib/roles';
import { formatDate, formatNumber } from '@/lib/expiry';
import type { Chemical, Lot, StorageLocation } from '@/lib/types';

const HAZARD_LABELS: Record<string, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  toxic: 'Độc hại',
};

export default function ChemicalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { profile } = useAuth();
  const canEdit = profile ? canManageStock(profile.role) : false;

  const [chemical, setChemical] = useState<Chemical | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = getSupabase();
      const [{ data: chem }, { data: lotData }, { data: locData }] = await Promise.all([
        supabase.from('chemicals').select('*').eq('id', id).maybeSingle(),
        supabase.from('lots').select('*').eq('chemical_id', id).order('received_date', { ascending: false }),
        supabase.from('storage_locations').select('*'),
      ]);

      setChemical(chem as Chemical | null);
      setLots((lotData || []) as Lot[]);

      const locMap: Record<string, string> = {};
      (locData || []).forEach((l: StorageLocation) => { locMap[l.id] = l.name; });
      setLocations(locMap);
      setLoading(false);
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!chemical) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Không tìm thấy hóa chất</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/chemicals')}>
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const totalStock = lots.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/chemicals"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{chemical.name}</h1>
            <Badge variant="outline" className="font-mono">{chemical.code}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {chemical.formula && `${chemical.formula} · `}
            CAS: {chemical.cas_number || '—'}
          </p>
        </div>
        <Button variant="outline" onClick={() => setQrOpen(true)}>
          <QrCode className="mr-2 h-4 w-4" />
          Mã QR
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Tổng tồn kho</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(totalStock)} <span className="text-lg text-muted-foreground">{chemical.unit}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Mức nguy hiểm</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">{HAZARD_LABELS[chemical.hazard_level]}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Tồn kho tối thiểu</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold">{formatNumber(chemical.min_stock)} {chemical.unit}</p></CardContent>
        </Card>
      </div>

      {chemical.description && (
        <Card>
          <CardHeader><CardTitle className="text-base">Mô tả</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{chemical.description}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Lô / Số lô ({lots.length})</CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => router.push('/stock-in')}>
              <Plus className="mr-2 h-4 w-4" />
              Nhập lô mới
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {lots.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Chưa có lô nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Số lô</TableHead>
                    <TableHead className="text-right">Số lượng</TableHead>
                    <TableHead>Ngày nhập</TableHead>
                    <TableHead>Hạn sử dụng</TableHead>
                    <TableHead>Vị trí</TableHead>
                    <TableHead>Nhà cung cấp</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell className="font-mono text-xs">{lot.lot_number || '—'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(lot.quantity)} / {formatNumber(lot.initial_quantity)} {lot.unit}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(lot.received_date)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">{formatDate(lot.expiry_date)}</span>
                          <ExpiryBadge expiryDate={lot.expiry_date} />
                        </div>
                      </TableCell>
                      <TableCell>{lot.storage_location_id ? locations[lot.storage_location_id] || '—' : '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{lot.supplier || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={lot.status === 'active' ? 'default' : lot.status === 'expired' ? 'destructive' : 'secondary'}>
                          {lot.status === 'active' ? 'Hoạt động' : lot.status === 'expired' ? 'Hết hạn' : 'Đã hết'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <QRDialog chemical={chemical} open={qrOpen} onOpenChange={setQrOpen} />
    </div>
  );
}
