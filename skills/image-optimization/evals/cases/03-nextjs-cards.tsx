// Eval 03: Next.js 15 product page (package.json: "next": "15.x")
import Image from 'next/image';

type Product = { id: string; name: string; image: string; width: number; height: number };

export function ProductHero({ product }: { product: Product }) {
  // bug: LCP image without priority, so next/image lazy-loads it
  return (
    <section className="hero">
      <Image src={product.image} alt={product.name} width={product.width} height={product.height} />
    </section>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {products.map((p) => (
        <div key={p.id} className="relative h-64">
          {/* bug: priority on every card, fill without sizes, fill without object-fit */}
          <Image src={p.image} alt={p.name} fill priority />
        </div>
      ))}
    </div>
  );
}

export function Avatar({ src }: { src: string }) {
  // bug: fixed width and height classes, no object-cover; remote src without width/height; empty alt
  return <Image src={src} alt="" className="w-12 h-16 rounded-full" />;
}
