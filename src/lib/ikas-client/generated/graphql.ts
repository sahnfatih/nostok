import { BaseGraphQLAPIClient, BaseGraphQLAPIClientOptions, APIResult } from '@ikas/admin-api-client';

export enum StorefrontJSScriptContentTypeEnum {
  FILE = "FILE",
  SCRIPT = "SCRIPT"
}

export type CreateStorefrontJSScriptInput = {
  contentType: StorefrontJSScriptContentTypeEnum;
  fileName?: string;
  isHighPriority?: boolean;
  name: string;
  scriptContent: string;
  storefrontId: string;
}

export type NumberFilterInput = {
  eq?: number;
  gt?: number;
  gte?: number;
  in?: Array<number>;
  lt?: number;
  lte?: number;
  ne?: number;
  nin?: Array<number>;
}

export type PaginationInput = {
  limit?: number;
  page?: number;
}

export type UpdateProductVariantPricesInputPrice = {
  buyPrice?: number;
  discountPrice?: number;
  sellPrice: number;
}

export type UpdateStorefrontJSScriptInput = {
  contentType?: StorefrontJSScriptContentTypeEnum;
  fileName?: string;
  id: string;
  isHighPriority?: boolean;
  name?: string;
  scriptContent?: string;
  storefrontId?: string;
}

export type UpdateVariantPricesInput = {
  priceListId?: string;
  variantPriceInputs: Array<UpdateVariantPricesInputVariantPrice>;
}

export type UpdateVariantPricesInputVariantPrice = {
  deleted?: boolean;
  price: UpdateProductVariantPricesInputPrice;
  productId: string;
  variantId: string;
}

export type GetMerchantQueryVariables = {}

export type GetMerchantQueryData = {
  id: string;
  email: string;
  storeName?: string;
}

export interface GetMerchantQuery {
  getMerchant: GetMerchantQueryData;
}

export type GetAuthorizedAppQueryVariables = {}

export type GetAuthorizedAppQueryData = {
  id: string;
  salesChannelId?: string;
  storeAppId: string;
  deleted: boolean;
  scope: string;
}

export interface GetAuthorizedAppQuery {
  getAuthorizedApp: GetAuthorizedAppQueryData;
}

export type ListProductsQueryVariables = {
  pagination?: PaginationInput;
  totalStock?: NumberFilterInput;
}

export type ListProductsQueryData = {
  count: number;
  hasNext: boolean;
  limit: number;
  page: number;
  data: Array<{
  id: string;
  name: string;
  totalStock?: number;
  createdAt?: number;
  updatedAt?: number;
  categories?: Array<{
  id: string;
  name: string;
}>;
  brand?: {
  id: string;
  name: string;
};
  variants: Array<{
  id: string;
  sku?: string;
  isActive: boolean;
  sellIfOutOfStock?: boolean;
  createdAt?: number;
  updatedAt?: number;
  prices: Array<{
  sellPrice: number;
  discountPrice?: number;
  buyPrice?: number;
  currencyCode?: string;
  currencySymbol?: string;
}>;
  stocks?: Array<{
  id: string;
  stockCount: number;
  stockLocationId: string;
}>;
  variantValues?: Array<{
  variantTypeId: string;
  variantTypeName: string;
  variantValueId: string;
  variantValueName: string;
}>;
}>;
}>;
}

export interface ListProductsQuery {
  listProduct: ListProductsQueryData;
}

export type ListStockLocationsQueryVariables = {}

export type ListStockLocationsQueryData = Array<{
  id: string;
  name: string;
  description?: string;
}>

export interface ListStockLocationsQuery {
  listStockLocation: ListStockLocationsQueryData;
}

export type UpdateVariantPricesMutationVariables = {
  input: UpdateVariantPricesInput;
}

export type UpdateVariantPricesMutationData = {
  errors?: Array<{
  errorCode: string;
  inputArrayIndex: number;
  inputData: {
  productId: string;
  variantId: string;
  price: {
  sellPrice: number;
  discountPrice?: number;
  buyPrice?: number;
};
};
}>;
}

export interface UpdateVariantPricesMutation {
  updateVariantPrices: UpdateVariantPricesMutationData;
}

export type DeleteCampaignsMutationVariables = {
  idList: string;
}

export type DeleteCampaignsMutationData = boolean

export interface DeleteCampaignsMutation {
  deleteCampaignList: DeleteCampaignsMutationData;
}

export type ListStorefrontQueryVariables = {}

export type ListStorefrontQueryData = Array<{
  id: string;
  name: string;
  salesChannelId: string;
}>

export interface ListStorefrontQuery {
  listStorefront: ListStorefrontQueryData;
}

export type CreateStorefrontJSScriptMutationVariables = {
  input: CreateStorefrontJSScriptInput;
}

export type CreateStorefrontJSScriptMutationData = {
  id: string;
  name: string;
  storefrontId: string;
  isActive: boolean;
}

export interface CreateStorefrontJSScriptMutation {
  createStorefrontJSScript: CreateStorefrontJSScriptMutationData;
}

export type UpdateStorefrontJSScriptMutationVariables = {
  input: UpdateStorefrontJSScriptInput;
}

export type UpdateStorefrontJSScriptMutationData = {
  id: string;
  name: string;
  storefrontId: string;
  isActive: boolean;
}

export interface UpdateStorefrontJSScriptMutation {
  updateStorefrontJSScript: UpdateStorefrontJSScriptMutationData;
}

export type DeleteStorefrontJSScriptMutationVariables = {}

export type DeleteStorefrontJSScriptMutationData = boolean

export interface DeleteStorefrontJSScriptMutation {
  deleteStorefrontJSScript: DeleteStorefrontJSScriptMutationData;
}

export class GeneratedQueries {
  client: BaseGraphQLAPIClient<any>;

  constructor(client: BaseGraphQLAPIClient<any>) {
    this.client = client;
  }

  async getMerchant(): Promise<APIResult<Partial<GetMerchantQuery>>> {
    const query = `
  query getMerchant {
    getMerchant {
      id
      email
      storeName
    }
  }
`;
    return this.client.query<Partial<GetMerchantQuery>>({ query });
  }

  async getAuthorizedApp(): Promise<APIResult<Partial<GetAuthorizedAppQuery>>> {
    const query = `
  query getAuthorizedApp {
    getAuthorizedApp {
      id
      salesChannelId
      storeAppId
      deleted
      scope
    }
  }
`;
    return this.client.query<Partial<GetAuthorizedAppQuery>>({ query });
  }

  async listProducts(variables: ListProductsQueryVariables): Promise<APIResult<Partial<ListProductsQuery>>> {
    const query = `
  query listProducts($pagination: PaginationInput, $totalStock: NumberFilterInput) {
    listProduct(pagination: $pagination, totalStock: $totalStock) {
      count
      hasNext
      limit
      page
      data {
        id
        name
        totalStock
        createdAt
        updatedAt
        categories {
          id
          name
        }
        brand {
          id
          name
        }
        variants {
          id
          sku
          isActive
          sellIfOutOfStock
          createdAt
          updatedAt
          prices {
            sellPrice
            discountPrice
            buyPrice
            currencyCode
            currencySymbol
          }
          stocks {
            id
            stockCount
            stockLocationId
          }
          variantValues {
            variantTypeId
            variantTypeName
            variantValueId
            variantValueName
          }
        }
      }
    }
  }
`;
    return this.client.query<Partial<ListProductsQuery>>({ query, variables });
  }

  async listStockLocations(): Promise<APIResult<Partial<ListStockLocationsQuery>>> {
    const query = `
  query listStockLocations {
    listStockLocation {
      id
      name
      description
    }
  }
`;
    return this.client.query<Partial<ListStockLocationsQuery>>({ query });
  }

  async listStorefront(): Promise<APIResult<Partial<ListStorefrontQuery>>> {
    const query = `
  query listStorefront {
    listStorefront {
      id
      name
      salesChannelId
    }
  }
`;
    return this.client.query<Partial<ListStorefrontQuery>>({ query });
  }
}

export class GeneratedMutations {
  client: BaseGraphQLAPIClient<any>;

  constructor(client: BaseGraphQLAPIClient<any>) {
    this.client = client;
  }

  async updateVariantPrices(variables: UpdateVariantPricesMutationVariables): Promise<APIResult<Partial<UpdateVariantPricesMutation>>> {
    const mutation = `
  mutation updateVariantPrices($input: UpdateVariantPricesInput!) {
    updateVariantPrices(input: $input) {
      errors {
        errorCode
        inputArrayIndex
        inputData {
          productId
          variantId
          price {
            sellPrice
            discountPrice
            buyPrice
          }
        }
      }
    }
  }
`;
    return this.client.mutate<Partial<UpdateVariantPricesMutation>>({ mutation, variables });
  }

  async deleteCampaigns(variables: DeleteCampaignsMutationVariables): Promise<APIResult<Partial<DeleteCampaignsMutation>>> {
    const mutation = `
  mutation deleteCampaigns($idList: [String!]!) {
    deleteCampaignList(idList: $idList)
  }
`;
    return this.client.mutate<Partial<DeleteCampaignsMutation>>({ mutation, variables });
  }

  async createStorefrontJSScript(variables: CreateStorefrontJSScriptMutationVariables): Promise<APIResult<Partial<CreateStorefrontJSScriptMutation>>> {
    const mutation = `
  mutation createStorefrontJSScript($input: CreateStorefrontJSScriptInput!) {
    createStorefrontJSScript(input: $input) {
      id
      name
      storefrontId
      isActive
    }
  }
`;
    return this.client.mutate<Partial<CreateStorefrontJSScriptMutation>>({ mutation, variables });
  }

  async updateStorefrontJSScript(variables: UpdateStorefrontJSScriptMutationVariables): Promise<APIResult<Partial<UpdateStorefrontJSScriptMutation>>> {
    const mutation = `
  mutation updateStorefrontJSScript($input: UpdateStorefrontJSScriptInput!) {
    updateStorefrontJSScript(input: $input) {
      id
      name
      storefrontId
      isActive
    }
  }
`;
    return this.client.mutate<Partial<UpdateStorefrontJSScriptMutation>>({ mutation, variables });
  }

  async deleteStorefrontJSScript(): Promise<APIResult<Partial<DeleteStorefrontJSScriptMutation>>> {
    const mutation = `
  mutation deleteStorefrontJSScript {
    deleteStorefrontJSScript
  }
`;
    return this.client.mutate<Partial<DeleteStorefrontJSScriptMutation>>({ mutation });
  }
}

export class ikasAdminGraphQLAPIClient<TokenData> extends BaseGraphQLAPIClient<TokenData> {
  queries: GeneratedQueries;
  mutations: GeneratedMutations;

  constructor(options: BaseGraphQLAPIClientOptions<TokenData>) {
    super(options);
    this.queries = new GeneratedQueries(this);
    this.mutations = new GeneratedMutations(this);
  }
}
