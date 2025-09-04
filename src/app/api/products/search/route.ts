import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    
    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
    const SHOPIFY_STORE_URL = SHOPIFY_STORE ? `https://${SHOPIFY_STORE}` : null;
    
    if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
      console.error('Shopify config missing:', { SHOPIFY_STORE, hasToken: !!SHOPIFY_ACCESS_TOKEN });
      return NextResponse.json({ error: 'Shopify configuration missing' }, { status: 500 });
    }

    // GraphQL query to search products
    const graphqlQuery = `
      query searchProducts($query: String!) {
        products(first: 20, query: $query) {
          edges {
            node {
              id
              title
              handle
              productType
              vendor
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    availableForSale
                    inventoryQuantity
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`${SHOPIFY_STORE_URL}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { query }
      }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform the GraphQL response to a simpler format
    const products = data.data?.products?.edges?.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      productType: edge.node.productType,
      vendor: edge.node.vendor,
      variants: edge.node.variants.edges.map((v: any) => ({
        id: v.node.id,
        title: v.node.title,
        sku: v.node.sku,
        price: v.node.price,
        available: v.node.availableForSale,
        inventory: v.node.inventoryQuantity,
        selectedOptions: v.node.selectedOptions || []
      })),
      priceRange: {
        min: edge.node.priceRange.minVariantPrice.amount,
        max: edge.node.priceRange.maxVariantPrice.amount,
        currency: edge.node.priceRange.minVariantPrice.currencyCode
      }
    })) || [];

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching products from Shopify:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}