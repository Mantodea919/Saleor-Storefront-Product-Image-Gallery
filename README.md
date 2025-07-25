# Saleor Storefront — Product Image Gallery Feature

This update enhances the Saleor storefront with a dynamic **Product Image Gallery** on the product detail page. Key highlights:

* **ProductGallery.tsx** — A React client component that displays a main product image with a selectable thumbnail strip below, supporting smooth image switching.
* **page.tsx** — Next.js Server Component handling product data fetching via GraphQL, integrating the ProductGallery component, and managing SEO metadata.
* **GraphQL queries** — Extended to fetch product media data necessary for rendering multiple product images in the gallery.

The gallery improves user experience by showcasing multiple product images with an intuitive thumbnail navigation on product pages.

---
