import axios from 'axios';
import { GetMerchantApiResponse } from '../app/api/ikas/get-merchant/route';
import { ScanLowStockResponse } from '../app/api/ikas/scan-low-stock/route';
import { AnalyticsResponse } from '../app/api/ikas/analytics/route';
import { ListCampaignsResponse, CreateCampaignResponse } from '../app/api/ikas/campaigns/route';
import { UpdateCampaignResponse } from '../app/api/ikas/campaigns/[id]/route';
import { ListRulesResponse } from '../app/api/ikas/rules/route';
import { ApplyRulesResponse } from '../app/api/ikas/rules/apply/route';
import { GetPopupResponse, SavePopupResponse } from '../app/api/ikas/popup/route';
import { PublishPopupResponse } from '../app/api/ikas/popup/publish/route';
import { InstallPopupScriptResponse } from '../app/api/ikas/popup/install/route';
import { GetSettingsResponse, MerchantSettings } from '../app/api/ikas/settings/route';
import type { PopupConfigInput } from './popup';
import { ApiResponseType } from '../globals/constants';

export async function makePostRequest<T>({ url, data, token }: { url: string; data?: unknown; token?: string }) {
  return axios.post<ApiResponseType<T>>(url, data, {
    headers: token
      ? {
          Authorization: `JWT ${token}`,
        }
      : undefined,
  });
}

export async function makeGetRequest<T>({ url, data, token }: { url: string; data?: unknown; token?: string }) {
  return axios.get<ApiResponseType<T>>(url, {
    params: data,
    headers: token
      ? {
          Authorization: `JWT ${token}`,
        }
      : undefined,
  });
}

export async function makePatchRequest<T>({ url, data, token }: { url: string; data?: unknown; token?: string }) {
  return axios.patch<ApiResponseType<T>>(url, data, {
    headers: token
      ? {
          Authorization: `JWT ${token}`,
        }
      : undefined,
  });
}

export async function makePutRequest<T>({ url, data, token }: { url: string; data?: unknown; token?: string }) {
  return axios.put<ApiResponseType<T>>(url, data, {
    headers: token
      ? {
          Authorization: `JWT ${token}`,
        }
      : undefined,
  });
}

export async function makeDeleteRequest<T>({ url, token }: { url: string; token?: string }) {
  return axios.delete<ApiResponseType<T>>(url, {
    headers: token
      ? {
          Authorization: `JWT ${token}`,
        }
      : undefined,
  });
}

// API requests object - frontend-backend bridge
export const ApiRequests = {
  ikas: {
    getMerchant: (token: string) => makeGetRequest<GetMerchantApiResponse>({ url: '/api/ikas/get-merchant', token }),

    // Stock scanning
    scanLowStock: (
      token: string,
      params?: {
        threshold?: number;
        include?: 'low' | 'out' | 'all';
        warehouse?: string;
        category?: string;
        brand?: string;
        search?: string;
        sort?: string;
      },
    ) => makeGetRequest<ScanLowStockResponse>({ url: '/api/ikas/scan-low-stock', token, data: params }),

    // Analytics & dead stock detection
    getAnalytics: (token: string, params?: { deadStockDays?: number; lowStockThreshold?: number }) =>
      makeGetRequest<AnalyticsResponse>({ url: '/api/ikas/analytics', token, data: params }),

    // Campaigns
    listCampaigns: (token: string, params?: { page?: number; limit?: number }) =>
      makeGetRequest<ListCampaignsResponse>({ url: '/api/ikas/campaigns', token, data: params }),
    createCampaign: (
      token: string,
      data: {
        title: string;
        discountPercent: number;
        ruleId?: string;
        variants: Array<{
          variantId: string;
          productId: string;
          productName: string;
          variantLabel: string;
          sellPrice: number;
          buyPrice: number | null;
          originalDiscountPrice: number | null;
        }>;
      },
    ) => makePostRequest<CreateCampaignResponse>({ url: '/api/ikas/campaigns', token, data }),
    deleteCampaign: (token: string, id: string) => makeDeleteRequest<{ success: boolean }>({ url: `/api/ikas/campaigns/${id}`, token }),
    updateCampaign: (token: string, id: string, data: { discountPercent?: number; title?: string }) =>
      makePatchRequest<UpdateCampaignResponse>({ url: `/api/ikas/campaigns/${id}`, token, data }),
    restoreCampaign: (token: string, id: string) =>
      makePostRequest<{ success: boolean }>({ url: `/api/ikas/campaigns/${id}/restore`, token }),

    // Clearance rules
    listRules: (token: string) => makeGetRequest<ListRulesResponse>({ url: '/api/ikas/rules', token }),
    createRule: (
      token: string,
      data: { name: string; stockThreshold: number; discountPercent: number; autoApply?: boolean; categoryFilter?: string },
    ) => makePostRequest<{ rule: unknown }>({ url: '/api/ikas/rules', token, data }),
    updateRule: (
      token: string,
      id: string,
      data: {
        name?: string;
        stockThreshold?: number;
        discountPercent?: number;
        isActive?: boolean;
        autoApply?: boolean;
        categoryFilter?: string | null;
      },
    ) => makePatchRequest<{ success: boolean }>({ url: `/api/ikas/rules/${id}`, token, data }),
    deleteRule: (token: string, id: string) => makeDeleteRequest<{ success: boolean }>({ url: `/api/ikas/rules/${id}`, token }),
    applyRules: (token: string, data?: { ruleId?: string }) =>
      makePostRequest<ApplyRulesResponse>({ url: '/api/ikas/rules/apply', token, data }),

    // Announcement popup (storefront duyuru modalı)
    getPopup: (token: string) => makeGetRequest<GetPopupResponse>({ url: '/api/ikas/popup', token }),
    savePopup: (token: string, data: PopupConfigInput) => makePutRequest<SavePopupResponse>({ url: '/api/ikas/popup', token, data }),
    uploadPopupImage: (token: string, dataUrl: string) =>
      makePostRequest<SavePopupResponse>({ url: '/api/ikas/popup/image', token, data: { dataUrl } }),
    deletePopupImage: (token: string) => makeDeleteRequest<SavePopupResponse>({ url: '/api/ikas/popup/image', token }),
    publishPopup: (token: string) => makePostRequest<PublishPopupResponse>({ url: '/api/ikas/popup/publish', token }),
    unpublishPopup: (token: string) => makeDeleteRequest<SavePopupResponse>({ url: '/api/ikas/popup/publish', token }),
    deletePopup: (token: string) => makeDeleteRequest<{ success: boolean }>({ url: '/api/ikas/popup', token }),
    installPopupScript: (token: string) =>
      makePostRequest<InstallPopupScriptResponse>({ url: '/api/ikas/popup/install', token }),

    // Persistent merchant settings (thresholds)
    getSettings: (token: string) => makeGetRequest<GetSettingsResponse>({ url: '/api/ikas/settings', token }),
    saveSettings: (token: string, data: Partial<MerchantSettings>) =>
      makePutRequest<GetSettingsResponse>({ url: '/api/ikas/settings', token, data }),
  },
};
