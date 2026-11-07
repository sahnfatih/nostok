import { gql } from 'graphql-request';

// ─── Merchant / App ───────────────────────────────────────────────────────────

export const GET_MERCHANT = gql`
  query getMerchant {
    getMerchant {
      id
      email
      storeName
    }
  }
`;

export const GET_AUTHORIZED_APP = gql`
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

// ─── Products (stock scanning) ────────────────────────────────────────────────

export const LIST_PRODUCTS = gql`
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

// ─── Stock Locations (warehouses) ────────────────────────────────────────────

export const LIST_STOCK_LOCATIONS = gql`
  query listStockLocations {
    listStockLocation {
      id
      name
      description
    }
  }
`;

// ─── Variant prices (discount price = storefront sale price) ─────────────────

export const UPDATE_VARIANT_PRICES = gql`
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

// ─── Campaigns (legacy cleanup of pre-discountPrice ikas campaigns) ──────────

export const DELETE_CAMPAIGNS = gql`
  mutation deleteCampaigns($idList: [String!]!) {
    deleteCampaignList(idList: $idList)
  }
`;

// â”€â”€â”€ Storefront JS scripts (announcement popup bootstrap) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const LIST_STOREFRONT = gql`
  query listStorefront {
    listStorefront {
      id
      name
      salesChannelId
    }
  }
`;

export const CREATE_STOREFRONT_JS_SCRIPT = gql`
  mutation createStorefrontJSScript($input: CreateStorefrontJSScriptInput!) {
    createStorefrontJSScript(input: $input) {
      id
      name
      storefrontId
      isActive
    }
  }
`;

export const UPDATE_STOREFRONT_JS_SCRIPT = gql`
  mutation updateStorefrontJSScript($input: UpdateStorefrontJSScriptInput!) {
    updateStorefrontJSScript(input: $input) {
      id
      name
      storefrontId
      isActive
    }
  }
`;

// v2: no arguments — deletes every JS script this app has added to any storefront.
export const DELETE_STOREFRONT_JS_SCRIPT = gql`
  mutation deleteStorefrontJSScript {
    deleteStorefrontJSScript
  }
`;
