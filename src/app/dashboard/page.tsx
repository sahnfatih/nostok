'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { Page, PageHeader } from '@/components/ikas/page';
import { ThemeSwitch } from '@/components/ikas/theme-switch';
import { usePageTheme } from '@/app/hooks/use-page-theme';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import OverviewTab from '@/components/clearance/overview-tab';
import ScannerTab from '@/components/clearance/scanner-tab';
import CampaignsTab from '@/components/clearance/campaigns-tab';
import RulesTab from '@/components/clearance/rules-tab';
import AnalyticsTab from '@/components/clearance/analytics-tab';
import PopupTab from '@/components/clearance/popup-tab';
import type { RuleApplyResult } from '@/app/api/ikas/rules/apply/route';

export type WarehouseStock = {
  warehouseId: string;
  warehouseName: string;
  stockCount: number;
};

export type ScannedVariant = {
  productId: string;
  productName: string;
  variantId: string;
  sku?: string;
  variantLabel: string;
  stockCount: number;
  sellPrice: number;
  discountPrice?: number;
  buyPrice?: number;
  stockValue: number;
  currencyCode?: string;
  currencySymbol?: string;
  categoryName?: string;
  brandName?: string;
  isActive: boolean;
  stockStatus: 'low' | 'out' | 'ok';
  warehouseStocks: WarehouseStock[];
};

export type WarehouseSummary = {
  id: string;
  name: string;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockValue: number;
};

export type CampaignVariantDetail = {
  variantId: string;
  productName: string;
  variantLabel: string;
  sellPrice: number | null;
  discountPrice: number | null;
};

export type CampaignSummary = {
  id: string;
  campaignId: string;
  title: string;
  discountPercent: number;
  status: string;
  ruleId?: string | null;
  variantIds: string[];
  variantDetails: CampaignVariantDetail[];
  createdAt: string;
  updatedAt: string;
};

export type ClearanceRule = {
  id: string;
  name: string;
  stockThreshold: number;
  discountPercent: number;
  isActive: boolean;
  autoApply: boolean;
  categoryFilter?: string;
  createdAt: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [theme, setTheme] = usePageTheme();

  // Data states
  const [scannedVariants, setScannedVariants] = useState<ScannedVariant[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [rules, setRules] = useState<ClearanceRule[]>([]);
  const [threshold, setThreshold] = useState(5);
  const [thresholdTouched, setThresholdTouched] = useState(false);
  const [deadStockDays, setDeadStockDays] = useState(30);
  const [scanning, setScanning] = useState(false);

  // Close loader on mount
  useEffect(() => {
    AppBridgeHelper.closeLoader();
  }, []);

  // Fetch scanned variants
  const fetchLowStock = useCallback(async (currentToken: string, stockThreshold: number) => {
    setScanning(true);
    try {
      const res = await ApiRequests.ikas.scanLowStock(currentToken, {
        threshold: stockThreshold,
        include: 'all',
      });
      if (res.status === 200 && res.data?.data) {
        const d = res.data.data;
        setScannedVariants(d.variants);
        setLowStockCount(d.lowStockCount);
        setOutOfStockCount(d.outOfStockCount);
        setCategories(d.categories || []);
        setBrands(d.brands || []);
        setWarehouses(d.warehouses || []);
      }
    } catch (error) {
      console.error('Error scanning low stock:', error);
    } finally {
      setScanning(false);
    }
  }, []);

  // Fetch campaigns
  const fetchCampaigns = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.ikas.listCampaigns(currentToken);
      if (res.status === 200 && res.data?.data) {
        setCampaigns(res.data.data.campaigns);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  }, []);

  // Fetch rules
  const fetchRules = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.ikas.listRules(currentToken);
      if (res.status === 200 && res.data?.data) {
        setRules(res.data.data.rules);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  }, []);

  // Run auto-apply rules in the background (no-op when none are enabled)
  const runAutoRules = useCallback(
    async (currentToken: string) => {
      try {
        const res = await ApiRequests.ikas.applyRules(currentToken);
        if (res.status === 200 && res.data?.data && res.data.data.campaignsCreated > 0) {
          toast.success(`Otomatik kurallar: ${res.data.data.campaignsCreated} kampanya oluşturuldu`);
          await fetchCampaigns(currentToken);
        }
      } catch (error) {
        console.error('Error auto-applying rules:', error);
      }
    },
    [fetchCampaigns],
  );

  // Apply a single rule on demand
  const handleApplyRule = useCallback(
    async (id: string): Promise<RuleApplyResult> => {
      if (!token) throw new Error('Token bulunamadı');
      const res = await ApiRequests.ikas.applyRules(token, { ruleId: id });
      if (res.status !== 200 || !res.data?.data) {
        throw new Error('Kural uygulanamadı');
      }
      const result = res.data.data.results[0];
      if (!result) throw new Error('Kural uygulanamadı');
      if (result.status === 'created') {
        await fetchCampaigns(token);
      }
      return result;
    },
    [token, fetchCampaigns],
  );

  // Initialize token and fetch data
  useEffect(() => {
    let cancelled = false;

    TokenHelpers.getTokenForIframeApp()
      .then(async (fetchedToken) => {
        if (cancelled) return;
        setToken(fetchedToken || null);
        if (fetchedToken) {
          // Fetch merchant info
          const merchantRes = await ApiRequests.ikas.getMerchant(fetchedToken);
          if (!cancelled && merchantRes.status === 200 && merchantRes.data?.data?.merchantInfo?.storeName) {
            setStoreName(merchantRes.data.data.merchantInfo.storeName);
          }

          // Persistent settings first, so the initial scan uses the saved threshold
          let savedThreshold = threshold;
          try {
            const settingsRes = await ApiRequests.ikas.getSettings(fetchedToken);
            if (!cancelled && settingsRes.status === 200 && settingsRes.data?.data) {
              const s = settingsRes.data.data.settings;
              savedThreshold = s.stockThreshold;
              setThreshold(s.stockThreshold);
              setThresholdTouched(s.thresholdTouched);
              setDeadStockDays(s.deadStockDays);
            }
          } catch (error) {
            console.error('Error loading settings:', error);
          }

          // Fetch all data in parallel
          await Promise.all([
            fetchLowStock(fetchedToken, savedThreshold),
            fetchCampaigns(fetchedToken),
            fetchRules(fetchedToken),
          ]);

          // Let active auto-apply rules create campaigns in the background
          if (!cancelled) {
            void runAutoRules(fetchedToken);
          }

          // Inject the (inert) popup bootstrap script on first load so the
          // storefront lifecycle is complete; renders nothing until published.
          if (!cancelled) {
            void ApiRequests.ikas.installPopupScript(fetchedToken).catch((error) => {
              console.error('Popup script install failed:', error);
            });
          }
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error initializing dashboard:', error);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle threshold change and rescan (persisted per merchant)
  const handleThresholdChange = useCallback(
    (newThreshold: number) => {
      setThreshold(newThreshold);
      setThresholdTouched(true);
      if (token) {
        fetchLowStock(token, newThreshold);
        ApiRequests.ikas
          .saveSettings(token, { stockThreshold: newThreshold, thresholdTouched: true })
          .catch((error) => console.error('Error saving threshold:', error));
      }
    },
    [token, fetchLowStock],
  );

  // Dead-stock aging threshold (persisted per merchant)
  const handleDeadStockDaysChange = useCallback(
    (days: number) => {
      setDeadStockDays(days);
      if (token) {
        ApiRequests.ikas
          .saveSettings(token, { deadStockDays: days })
          .catch((error) => console.error('Error saving deadStockDays:', error));
      }
    },
    [token],
  );

  // Handle campaign creation
  const handleCreateCampaign = useCallback(
    async (
      campaignVariants: Array<{
        variantId: string;
        productId: string;
        productName: string;
        variantLabel: string;
        sellPrice: number;
        buyPrice: number | null;
        originalDiscountPrice: number | null;
      }>,
      discountPercent: number,
      title: string,
    ) => {
      if (!token) return;
      try {
        const res = await ApiRequests.ikas.createCampaign(token, {
          title,
          discountPercent,
          variants: campaignVariants,
        });
        if (res.status === 200) {
          await fetchCampaigns(token);
          await fetchLowStock(token, threshold);
        }
      } catch (error) {
        console.error('Error creating campaign:', error);
        throw error;
      }
    },
    [token, fetchCampaigns, fetchLowStock, threshold],
  );

  // Handle rule creation
  const handleCreateRule = useCallback(
    async (rule: {
      name: string;
      stockThreshold: number;
      discountPercent: number;
      autoApply?: boolean;
      categoryFilter?: string;
    }) => {
      if (!token) return;
      try {
        await ApiRequests.ikas.createRule(token, rule);
        await fetchRules(token);
      } catch (error) {
        console.error('Error creating rule:', error);
        throw error;
      }
    },
    [token, fetchRules],
  );

  // Handle rule toggle
  const handleToggleRule = useCallback(
    async (id: string, isActive: boolean) => {
      if (!token) return;
      try {
        await ApiRequests.ikas.updateRule(token, id, { isActive });
        await fetchRules(token);
      } catch (error) {
        console.error('Error toggling rule:', error);
      }
    },
    [token, fetchRules],
  );

  // Handle rule delete
  const handleDeleteRule = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        await ApiRequests.ikas.deleteRule(token, id);
        await fetchRules(token);
      } catch (error) {
        console.error('Error deleting rule:', error);
      }
    },
    [token, fetchRules],
  );

  // Handle campaign delete
  const handleDeleteCampaign = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        await ApiRequests.ikas.deleteCampaign(token, id);
        await fetchCampaigns(token);
      } catch (error) {
        console.error('Error deleting campaign:', error);
        throw error;
      }
    },
    [token, fetchCampaigns],
  );

  // Handle campaign discount/title update
  const handleUpdateCampaign = useCallback(
    async (id: string, data: { discountPercent?: number; title?: string }) => {
      if (!token) return;
      try {
        await ApiRequests.ikas.updateCampaign(token, id, data);
        await fetchCampaigns(token);
      } catch (error) {
        console.error('Error updating campaign:', error);
        throw error;
      }
    },
    [token, fetchCampaigns],
  );

  // Undo an accidental campaign end
  const handleRestoreCampaign = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        await ApiRequests.ikas.restoreCampaign(token, id);
        await fetchCampaigns(token);
      } catch (error) {
        console.error('Error restoring campaign:', error);
        throw error;
      }
    },
    [token, fetchCampaigns],
  );

  // Variants already covered by an active campaign (hidden in the scanner by default)
  const coveredVariantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of campaigns) {
      for (const id of c.variantIds) ids.add(id);
    }
    return [...ids];
  }, [campaigns]);

  // How much of the actionable low/out-of-stock stock is already under a campaign
  const coverage = useMemo(() => {
    const coveredSet = new Set(coveredVariantIds);
    const actionable = scannedVariants.filter((v) => v.stockStatus !== 'ok');
    return {
      actionable: actionable.length,
      covered: actionable.filter((v) => coveredSet.has(v.variantId)).length,
    };
  }, [scannedVariants, coveredVariantIds]);

  if (loading) {
    return (
      <Page width="wide">
        <PageHeader title="Stok Erime Kampanyaları" />
        <div className="space-y-6">
          <Skeleton className="h-9 w-full max-w-2xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </Page>
    );
  }

  if (!token) {
    return (
      <Page>
        <PageHeader title="Stok Erime Kampanyaları" />
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p>Bu ekranı görmek için uygulamayı ikas panelinden açın.</p>
        </div>
      </Page>
    );
  }

  return (
    <Page width="wide">
      <PageHeader
        title="Stok Erime Kampanyaları"
        description={
          storeName
            ? `${storeName} mağazası için düşük stoklu varyantları tespit edin ve indirim kampanyaları oluşturun.`
            : 'Düşük stoklu varyantları tespit edin ve indirim kampanyaları oluşturun.'
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="flex w-max flex-nowrap">
              <TabsTrigger value="overview">
                <span className="sm:hidden">Özet</span>
                <span className="hidden sm:inline">Genel bakış</span>
              </TabsTrigger>
              <TabsTrigger value="scanner">
                <span className="sm:hidden">Tarama</span>
                <span className="hidden sm:inline">Stok taraması</span>
                {lowStockCount > 0 && (
                  <Badge status="warning" className="ml-2">
                    {lowStockCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="campaigns">
                Kampanyalar
                {campaigns.length > 0 && (
                  <Badge status="info" className="ml-2">
                    {campaigns.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="analytics">Analiz</TabsTrigger>
              <TabsTrigger value="popup">Duyuru</TabsTrigger>
              <TabsTrigger value="rules">
                <span className="sm:hidden">Kurallar</span>
                <span className="hidden sm:inline">Otomatik kurallar</span>
                {rules.length > 0 && (
                  <Badge status="neutral" className="ml-2">
                    {rules.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
          <ThemeSwitch theme={theme} onThemeChange={setTheme} transition="rise" iconOnly variant="ghost" />
        </div>

        <TabsContent value="overview">
          <OverviewTab
            lowStockCount={lowStockCount}
            outOfStockCount={outOfStockCount}
            activeCampaignCount={campaigns.length}
            ruleCount={rules.length}
            threshold={threshold}
            thresholdTouched={thresholdTouched}
            onThresholdChange={handleThresholdChange}
            scanning={scanning}
            onNavigate={setActiveTab}
            coveredCount={coverage.covered}
            actionableCount={coverage.actionable}
          />
        </TabsContent>

        <TabsContent value="scanner">
          <ScannerTab
            variants={scannedVariants}
            loading={scanning}
            threshold={threshold}
            onThresholdChange={handleThresholdChange}
            onCreateCampaign={handleCreateCampaign}
            categories={categories}
            brands={brands}
            warehouses={warehouses}
            lowStockCount={lowStockCount}
            outOfStockCount={outOfStockCount}
            coveredVariantIds={coveredVariantIds}
          />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignsTab
            campaigns={campaigns}
            onDelete={handleDeleteCampaign}
            onUpdate={handleUpdateCampaign}
            onRestore={handleRestoreCampaign}
            onNavigate={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab
            token={token}
            threshold={threshold}
            deadStockDays={deadStockDays}
            onDeadStockDaysChange={handleDeadStockDaysChange}
          />
        </TabsContent>

        <TabsContent value="popup">
          <PopupTab token={token} />
        </TabsContent>

        <TabsContent value="rules">
          <RulesTab
            rules={rules}
            categories={categories}
            onCreate={handleCreateRule}
            onToggle={handleToggleRule}
            onDelete={handleDeleteRule}
            onApply={handleApplyRule}
          />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
