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
