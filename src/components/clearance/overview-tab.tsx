'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';
import { StatCard } from '@/components/ikas/stat-card';
import { NumberStepper } from '@/components/ikas/number-stepper';
import { Launchpad, type LaunchpadStep } from '@/components/ikas/launchpad';
import { AnimatedNumber } from '@/components/ikas/animated-number';
import { Banner } from '@/components/ikas/banner';
import { ProgressBar } from '@/components/ikas/progress-bar';
import { formatNumber } from '@/lib/format';
import { ArrowRightIcon, SearchIcon, SettingsIcon } from 'lucide-react';

const LAUNCHPAD_DISMISSED_KEY = 'nostok-launchpad-dismissed';

interface OverviewTabProps {
  lowStockCount: number;
  outOfStockCount: number;
  activeCampaignCount: number;
  ruleCount: number;
  threshold: number;
  thresholdTouched: boolean;
  onThresholdChange: (value: number) => void;
  scanning: boolean;
  onNavigate: (tab: string) => void;
  coveredCount: number;
  actionableCount: number;
}

export default function OverviewTab({
  lowStockCount,
  outOfStockCount,
  activeCampaignCount,
  ruleCount,
  threshold,
  thresholdTouched,
  onThresholdChange,
  scanning,
  onNavigate,
  coveredCount,
  actionableCount,
}: OverviewTabProps) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(LAUNCHPAD_DISMISSED_KEY) === '1',
  );

  const steps: LaunchpadStep[] = [
    {
      id: 'threshold',
      label: 'Stok eşiğini mağazanıza göre ayarlayın',
      description: 'Aşağıdaki eşik değeri, hangi varyantların "düşük stok" sayılacağını belirler.',
      eta: '~1 dk',
      status: thresholdTouched ? 'done' : 'todo',
    },
    {
      id: 'campaign',
      label: 'İlk indirim kampanyanızı oluşturun',
      description: 'Düşük stoklu varyantları seçin, indirim oranını belirleyin; fiyatlar mağazaya anında yansır.',
      eta: '~2 dk',
      status: activeCampaignCount > 0 ? 'done' : 'todo',
      actions: (
        <Button size="sm" onClick={() => onNavigate('scanner')}>
          <SearchIcon className="size-4" />
          Taramaya git
        </Button>
      ),
    },
    {
      id: 'rule',
      label: 'Otomatik kural tanımlayın',
      description: 'Stok eşiğine düşen varyantlar için kampanyaların kendiliğinden oluşmasını sağlayın.',
      eta: '~2 dk',
      status: ruleCount > 0 ? 'done' : 'todo',
      actions: (
        <Button size="sm" variant="outline" onClick={() => onNavigate('rules')}>
          <SettingsIcon className="size-4" />
          Kural oluştur
        </Button>
      ),
    },
  ];

  const dismissLaunchpad = () => {
    localStorage.setItem(LAUNCHPAD_DISMISSED_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="space-y-6">
      {!dismissed && (
        <Launchpad
          steps={steps}
          title="İlk kurulum"
          layout="checklist"
          doneTitle="Kurulum tamamlandı"
          onDismiss={dismissLaunchpad}
        />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Düşük stoklu varyant"
          value={<AnimatedNumber value={lowStockCount} format={formatNumber} />}
          footer={<p className="text-xs text-muted-foreground">Stok 1–{threshold} arası varyantlar</p>}
        />
        <StatCard
          label="Tükenen varyant"
          value={<AnimatedNumber value={outOfStockCount} format={formatNumber} />}
          footer={<p className="text-xs text-muted-foreground">Stok yenileme gerekiyor</p>}
        />
        <StatCard
          label="Aktif kampanya"
          value={<AnimatedNumber value={activeCampaignCount} format={formatNumber} />}
          footer={<p className="text-xs text-muted-foreground">Çalışan indirim kampanyaları</p>}
        />
        <StatCard
          label="Otomatik kural"
          value={<AnimatedNumber value={ruleCount} format={formatNumber} />}
          footer={<p className="text-xs text-muted-foreground">Tanımlı stok erime kuralları</p>}
        />
      </div>

      {/* Campaign coverage */}
      {actionableCount > 0 && (
        <Card>
          <CardContent className="p-4">
            <ProgressBar
              label="Kampanya kapsaması"
              value={coveredCount}
              max={actionableCount}
              status="auto"
              valueFormat={(value, max) => `${formatNumber(value)} / ${formatNumber(max)} varyant`}
              hint="Düşük stoklu ve tükenen varyantların kampanya altına alınan bölümü"
            />
          </CardContent>
        </Card>
      )}

      {/* Threshold setting */}
      <Card>
        <CardHeader>
          <CardTitle>Stok eşik değeri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <Field className="flex-1">
              <FieldLabel>Düşük stok eşiği</FieldLabel>
              <FieldDescription>Bu değerin altındaki varyantlar &quot;düşük stok&quot; olarak işaretlenir.</FieldDescription>
              <NumberStepper label="Düşük stok eşiği" value={threshold} onValueChange={onThresholdChange} min={0} max={1000} />
            </Field>
            <Button variant="outline" onClick={() => onNavigate('scanner')} disabled={scanning}>
              <SearchIcon className="size-4" />
              {scanning ? 'Taranıyor...' : 'Şimdi tara'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card
          className="cursor-pointer transition-[background-color,box-shadow] hover:bg-accent/60 hover:shadow-md"
          onClick={() => onNavigate('scanner')}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <h3 className="font-medium">Düşük stokları tara</h3>
              <p className="text-sm text-muted-foreground">Varyant bazlı stok seviyelerini görüntüleyin</p>
            </div>
            <ArrowRightIcon className="size-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-[background-color,box-shadow] hover:bg-accent/60 hover:shadow-md"
          onClick={() => onNavigate('rules')}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <h3 className="font-medium">Otomatik kural oluştur</h3>
              <p className="text-sm text-muted-foreground">Stok seviyesine göre otomatik indirim tanımlayın</p>
            </div>
            <ArrowRightIcon className="size-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      {lowStockCount > 0 && (
        <Banner
          status="warning"
          title={`${formatNumber(lowStockCount)} varyant düşük stok seviyesinde`}
          actions={
            <Button size="sm" onClick={() => onNavigate('scanner')}>
              Varyantları görüntüle
            </Button>
          }
        >
          <p>Bu varyantlara indirim kampanyası oluşturarak stok erimesini hızlandırabilirsiniz.</p>
        </Banner>
      )}
    </div>
  );
}
