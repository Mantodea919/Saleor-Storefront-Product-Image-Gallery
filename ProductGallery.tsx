// src/ui/components/ProductGallery.tsx
//
"use client";
import React from "react"
import { useState } from 'react';
import Image from 'next/image';

export function ProductGallery({ media }: {
  media: Array<{ id: string; url: string; alt: string }>
}) {
  const [selectedImage, setSelectedImage] = useState(0);

  if (media.length === 0) {
    return <div className="bg-gray-200 aspect-square h-full w-full rounded-lg" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-xl bg-gray-100 aspect-square">
        <Image
          src={media[selectedImage].url}
          alt={media[selectedImage].alt || "Product image"}
          fill
          priority
          className="object-contain"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto py-2">
        {media.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setSelectedImage(index)}
            className={`shrink-0 rounded-lg border transition-all ${
              selectedImage === index
                ? 'border-blue-500 border-2'
                : 'border-gray-300'
            }`}
          >
            <div className="relative h-16 w-16">
              <Image
                src={image.url}
                alt={image.alt || `Thumbnail ${index + 1}`}
                fill
                className="object-cover"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
