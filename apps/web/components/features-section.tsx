"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { MdArrowUpward } from "react-icons/md";

const features = [
  {
    image: "/upload.png", // Add your image path here
    title: "Format & Upload",
    description: "Beautify messy strings into standard schemas in a click.",
  },
  {
    image: "/graph.png", // Add your image path here
    title: "Graph & Tree",
    description: "Visualize complex data relationships with interactive nodes.",
  },
  {
    image: "/json-viewer.png", // Add your image path here
    title: "Tree Explorer",
    description: "Instantly explore deeply nested objects with precision.",
  },
  {
    image: "/text-editor.png", // Add your image path here
    title: "Rich-Text Editor",
    description: "A sleek dual-mode document interface for technical teams.",
  },
];

export default function FeaturesSection() {
  const router = useRouter();

  const handleNavigation = (index: number) => {
    switch (index) {
      case 0:
        router.push("/editor?view=formatter");
        break;
      case 1:
        router.push("/editor?view=visualize");
        break;
      case 2:
        router.push("/editor?view=tree");
        break;
      case 3:
        router.push("/editor?type=text");
        break;
      default:
        router.push("/editor");
    }
  };

  return (
    <section
      className="pt-10 md:pt-0 pb-16 md:pb-24 px-6 max-w-7xl mx-auto"
      id="features"
    >
      <div className="mb-10 md:mb-16 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-heading tracking-tight">
          Engineered for{" "}
          <span className="text-primary underline decoration-primary/20 decoration-4 underline-offset-8">
            Speed
          </span>
        </h2>
        <p className="text-paragraph text-md lg:text-xl w-3xl w-4/5 max-w-[573px] mx-auto">
          Experience the most advanced toolset ever built for modern data
          engineering.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {features.map((feature, index) => (
          <FeatureCard
            key={index}
            {...feature}
            onClick={() => handleNavigation(index)}
          />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({
  image,
  title,
  description,
  onClick,
}: {
  image: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="neubrutalist-card p-8 rounded-2xl relative overflow-hidden flex flex-col group h-full cursor-pointer hover:scale-[1.02] transition-all duration-300"
    >
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 card-inner-grid opacity-30 pointer-events-none"></div>

      {/* Image Section with Circular Background */}
      <div className="relative z-10 mb-8 flex justify-center">
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Light Circular Background */}
          <div className="absolute inset-0 bg-primary/10 rounded-full"></div>
          {/* Image */}
          <div className="relative w-16 h-16">
            <Image src={image} alt={title} fill className="object-contain" />
          </div>
        </div>
      </div>

      {/* Text Content */}
      <div className="relative z-10 flex-1">
        <h3 className="text-2xl md:text-3xl font-black mb-4 text-heading leading-tight">
          {title}
        </h3>
        <p className="text-base text-paragraph font-medium leading-relaxed">
          {description}
        </p>
      </div>

      {/* Arrow Icon */}
      <div className="mt-8 flex justify-end">
        <div className="bg-heading text-white group-hover:bg-primary transition-colors size-12 rounded-full flex items-center justify-center">
          <MdArrowUpward className="text-2xl rotate-45 group-hover:rotate-[90deg] transition-all duration-300" />
        </div>
      </div>
    </div>
  );
}
