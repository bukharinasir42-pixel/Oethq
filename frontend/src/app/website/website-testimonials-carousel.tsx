"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

export type WebsiteTestimonialImage = {
    src: string;
    alt: string;
};

type WebsiteTestimonialsCarouselProps = {
    images: WebsiteTestimonialImage[];
};

const proofNavBtn =
    "static top-auto bottom-auto left-auto right-auto h-10 w-10 translate-x-0 translate-y-0 rounded-full border-2 border-[#5b6fcf] bg-white text-[#5b6fcf] shadow-sm hover:bg-[#5b6fcf]/10 hover:text-[#4a5ab8] disabled:opacity-40";

export function WebsiteTestimonialsCarousel({ images }: WebsiteTestimonialsCarouselProps) {
    const [activeImage, setActiveImage] = useState<WebsiteTestimonialImage | null>(null);

    useEffect(() => {
        if (!activeImage) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setActiveImage(null);
        };
        window.addEventListener("keydown", onKeyDown);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = "";
        };
    }, [activeImage]);

    return (
        <div className="mx-auto w-full max-w-6xl pb-6">
            <Carousel
                opts={{
                    align: "center",
                    loop: true,
                }}
                className="w-full"
            >
                <div className="flex items-center justify-center gap-3 md:gap-5">
                    <CarouselPrevious
                        className={cn(proofNavBtn, "shrink-0")}
                        aria-label="Previous testimonial"
                    />
                    <div className="min-w-0 w-full max-w-5xl flex-1">
                        <CarouselContent className="ml-0">
                            {images.map((image) => (
                                <CarouselItem key={image.src} className="basis-full pl-0">
                                    <button
                                        type="button"
                                        onClick={() => setActiveImage(image)}
                                        className="block w-full cursor-zoom-in overflow-hidden rounded-xl"
                                        aria-label="View testimonial full screen"
                                    >
                                        <Image
                                            src={image.src}
                                            alt={image.alt}
                                            width={1200}
                                            height={900}
                                            className="h-auto w-full object-contain"
                                        />
                                    </button>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                    </div>
                    <CarouselNext
                        className={cn(proofNavBtn, "shrink-0")}
                        aria-label="Next testimonial"
                    />
                </div>
            </Carousel>

            {activeImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setActiveImage(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Testimonial full screen view"
                >
                    <button
                        type="button"
                        onClick={() => setActiveImage(null)}
                        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white transition hover:bg-white/20"
                        aria-label="Close full screen view"
                    >
                        ×
                    </button>
                    <div
                        className="relative flex max-h-[95vh] max-w-[95vw] items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Image
                            src={activeImage.src}
                            alt={activeImage.alt}
                            width={1600}
                            height={1200}
                            className="h-auto max-h-[95vh] w-auto max-w-[95vw] object-contain"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
