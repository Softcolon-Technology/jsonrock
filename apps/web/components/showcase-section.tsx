import React from "react";
import Image from "next/image";
import { FaRegCircleCheck } from "react-icons/fa6";

type ShowcaseData = {
  title: string;
  highlight: string;
  description: string;
  checklist: string[];
  image: string;
  imagePosition: "right" | "left";
};

const showcases: ShowcaseData[] = [
  {
    title: "The Beauty of",
    highlight: "Clean Code",
    description:
      "Format and refine complex JSON into a clean, human-readable structure in milliseconds.",
    checklist: [
      "One-click beautification",
      "Smart syntax highlighting",
      "Error detection & auto-fix",
      "Minification for production",
    ],
    image: "/json-fomatter.png", // Add your image path here
    imagePosition: "right",
  },
  {
    title: "Interactive",
    highlight: "Graph Viewer",
    description:
      "Map complex data relationships visually. Perfect for understanding large schemas at a glance.",
    checklist: [
      "Auto-discovery of references",
      "Physics-based layout engine",
      "Search and filter nodes",
      "Export as vector graphics",
    ],
    image: "/json-graph.png", // Add your image path here
    imagePosition: "left",
  },
  {
    title: "Seamless",
    highlight: "Tree Explorer",
    description:
      "Instantly transform raw JSON text into a collapsible, structured explorer for deep object browsing.",
    checklist: [
      "Collapsible object nodes",
      "Real-time sync with editor",
      "Path copy (JSONPath support)",
      "Value type identification",
    ],
    image: "/json-tree.png", // Add your image path here
    imagePosition: "right",
  },
];

export default function ShowcaseSection() {
  return (
    <section
      className="py-16 md:py-24 px-6 overflow-hidden bg-white"
      id="showcase"
    >
      {showcases.map((showcase, index) => (
        <ShowcaseItem
          key={index}
          {...showcase}
          isLast={index === showcases.length - 1}
        />
      ))}
    </section>
  );
}

function ShowcaseItem({
  title,
  highlight,
  description,
  checklist,
  image,
  imagePosition,
  isLast,
}: {
  title: string;
  highlight: string;
  description: string;
  checklist: string[];
  image: string;
  imagePosition: "left" | "right";
  isLast: boolean;
}) {
  const ImageCard = (
    <div className="relative">
      <div className="absolute -top-8 -left-14 w-[60%] h-[90%]">
        <Image src="/dot-pattern.png" alt="" fill className="object-contain" />
      </div>
      <div className="absolute -bottom-8 -right-14 w-[60%] h-[90%]">
        <Image src="/dot-pattern.png" alt="" fill className="object-contain" />
      </div>
      <div className="relative bg-white/80 backdrop-blur-sm border border-[#95DBDD] rounded-[20px] shadow-[0px_16px_16px_-10px_rgba(130,201,202,0.8)] overflow-hidden z-10">
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden">
          <Image
            src={image}
            alt={`${title} ${highlight}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 items-center gap-8 md:gap-12 lg:gap-20 ${
        !isLast ? "mb-16 md:mb-32" : ""
      }`}
    >
      {/* Text Content */}
      <div
        className={`space-y-6 ${
          imagePosition === "left" ? "order-1 md:order-2" : ""
        }`}
      >
        <h2 className="text-4xl md:text-5xl font-bold text-heading leading-tighter">
          {title} <br />
          <span className="text-primary">{highlight}</span>
        </h2>

        {/* Mobile Image */}
        <div className="block md:hidden">{ImageCard}</div>

        <p className="text-paragraph text-lg md:text-xl leading-relaxed">
          {description}
        </p>
        <ul className="space-y-3">
          {checklist.map((item, index) => (
            <CheckListItem key={index}>{item}</CheckListItem>
          ))}
        </ul>
      </div>

      {/* Desktop Image */}
      <div
        className={`relative group hidden md:block ${
          imagePosition === "left" ? "order-2 md:order-1" : ""
        }`}
      >
        {ImageCard}
      </div>
    </div>
  );
}

function CheckListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-heading font-normal">
      <FaRegCircleCheck className="text-primary text-lg flex-shrink-0" />
      {children}
    </li>
  );
}
