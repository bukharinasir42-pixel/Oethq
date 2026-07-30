import { cn } from "@/lib/utils";

type ExternalImageProps = {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: "eager" | "lazy";
};

export function ExternalImage({
  src,
  alt,
  className,
  width,
  height,
  loading = "lazy"
}: ExternalImageProps) {
  // Signed S3 URLs use arbitrary hosts; keep a native img (not next/image remotePatterns).
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={width} height={height} loading={loading} decoding="async" className={cn(className)} />;
}
