//   src/app/\[channel\]/\(main\)/products/\[slug\]/page.tsx

import edjsHTML from "editorjs-html";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { type ResolvingMetadata, type Metadata } from "next";
import xss from "xss";
import { invariant } from "ts-invariant";
import { type WithContext, type Product } from "schema-dts";

import { AddButton } from "./AddButton";
import { VariantSelector } from "@/ui/components/VariantSelector";
import { ProductGallery } from "@/ui/components/ProductGallery";
import { AvailabilityMessage } from "@/ui/components/AvailabilityMessage";

import { executeGraphQL } from "@/lib/graphql";
import { formatMoney, formatMoneyRange } from "@/lib/utils";
import {
  ProductDetailsDocument,
  ProductListDocument,
  CheckoutAddLineDocument,
} from "@/gql/graphql";

import * as Checkout from "@/lib/checkout";

const parser = edjsHTML();

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string; channel: string }>;
    searchParams: Promise<{ variant?: string }>;
  },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const [searchParams, params] = await Promise.all([props.searchParams, props.params]);

  const { product } = await executeGraphQL(ProductDetailsDocument, {
    variables: {
      slug: decodeURIComponent(params.slug),
      channel: params.channel,
    },
    revalidate: 60,
  });

  if (!product) notFound();

  const productName = product.seoTitle || product.name;
  const variantName = product.variants?.find(({ id }) => id === searchParams.variant)?.name;
  const title = variantName ? `${productName} - ${variantName}` : productName;

  return {
    title: `${title} | ${(await parent).title?.absolute ?? ""}`,
    description: product.seoDescription || title,
    alternates: {
      canonical: process.env.NEXT_PUBLIC_STOREFRONT_URL
        ? `${process.env.NEXT_PUBLIC_STOREFRONT_URL}/products/${encodeURIComponent(params.slug)}`
        : undefined,
    },
    openGraph: product.thumbnail
      ? {
          images: [
            {
              url: product.thumbnail.url,
              alt: product.name,
            },
          ],
        }
      : null,
  };
}

export async function generateStaticParams({ params }: { params: { channel: string } }) {
  const { products } = await executeGraphQL(ProductListDocument, {
    variables: { first: 20, channel: params.channel },
    revalidate: 60,
    withAuth: false,
  });

  return products?.edges.map(({ node }) => ({ slug: node.slug })) || [];
}

export default async function Page(props: {
  params: Promise<{ slug: string; channel: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const [searchParams, params] = await Promise.all([props.searchParams, props.params]);

  const { product } = await executeGraphQL(ProductDetailsDocument, {
    variables: {
      slug: decodeURIComponent(params.slug),
      channel: params.channel,
    },
    revalidate: 60,
  });

  if (!product) notFound();

  const description = product.description ? parser.parse(JSON.parse(product.description)) : null;
  const variants = product.variants;
  const selectedVariantID = searchParams.variant;
  const selectedVariant = variants?.find(({ id }) => id === selectedVariantID);
  const isAvailable = variants?.some((v) => v.quantityAvailable) ?? false;

  const price = selectedVariant?.pricing?.price?.gross
    ? formatMoney(
        selectedVariant.pricing.price.gross.amount,
        selectedVariant.pricing.price.gross.currency
      )
    : isAvailable
    ? formatMoneyRange({
        start: product.pricing?.priceRange?.start?.gross,
        stop: product.pricing?.priceRange?.stop?.gross,
      })
    : "";

  async function addItem() {
    "use server";

    const checkout = await Checkout.findOrCreate({
      checkoutId: await Checkout.getIdFromCookies(params.channel),
      channel: params.channel,
    });

    invariant(checkout, "Checkout must exist");

    await Checkout.saveIdToCookie(params.channel, checkout.id);

    if (!selectedVariantID) return;

    await executeGraphQL(CheckoutAddLineDocument, {
      variables: {
        id: checkout.id,
        productVariantId: decodeURIComponent(selectedVariantID),
      },
      cache: "no-cache",
    });

    revalidatePath("/cart");
  }

  const productJsonLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    image: product.thumbnail?.url,
    ...(selectedVariant
      ? {
          name: `${product.name} - ${selectedVariant.name}`,
          description: product.seoDescription || `${product.name} - ${selectedVariant.name}`,
          offers: {
            "@type": "Offer",
            availability: selectedVariant.quantityAvailable
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            priceCurrency: selectedVariant.pricing?.price?.gross.currency,
            price: selectedVariant.pricing?.price?.gross.amount,
          },
        }
      : {
          name: product.name,
          description: product.seoDescription || product.name,
          offers: {
            "@type": "AggregateOffer",
            availability: isAvailable
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            priceCurrency: product.pricing?.priceRange?.start?.gross.currency,
            lowPrice: product.pricing?.priceRange?.start?.gross.amount,
            highPrice: product.pricing?.priceRange?.stop?.gross.amount,
          },
        }),
  };

  return (
    <section className="mx-auto grid max-w-7xl p-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd),
        }}
      />
      <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-8" action={addItem}>
        <div className="md:col-span-1 lg:col-span-5">
          <ProductGallery media={product.media || []} />
        </div>

        <div className="flex flex-col pt-6 sm:col-span-1 sm:px-6 sm:pt-0 lg:col-span-3 lg:pt-16">
          <h1 className="mb-4 text-3xl font-medium tracking-tight text-neutral-900">
            {product.name}
          </h1>
          <p className="mb-8 text-sm" data-testid="ProductElement_Price">
            {price}
          </p>

          {variants && (
            <VariantSelector
              selectedVariant={selectedVariant}
              variants={variants}
              product={product}
              channel={params.channel}
            />
          )}

          <AvailabilityMessage isAvailable={isAvailable} />

          <div className="mt-8">
            <AddButton disabled={!selectedVariantID || !selectedVariant?.quantityAvailable} />
          </div>

          {description && (
            <div className="mt-8 space-y-6 text-sm text-neutral-500">
              {description.map((html, idx) => (
                <div key={idx} dangerouslySetInnerHTML={{ __html: xss(html) }} />
              ))}
            </div>
          )}
        </div>
      </form>
    </section>
  );
}
